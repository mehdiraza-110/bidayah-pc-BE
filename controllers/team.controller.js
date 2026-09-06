const teamService = require('../services/team.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

class TeamController {
  // ===== Banner =====

  async getBanner(req, res) {
    try {
      const banner = await teamService.getBanner();
      res.status(200).json({
        success: true,
        message: 'Team page banner retrieved successfully',
        data: banner,
      });
    } catch (error) {
      console.error('Error fetching team page banner:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching team page banner',
        error: error.message,
      });
    }
  }

  async upsertBanner(req, res) {
    try {
      const { heading, subtext } = req.body;

      if (!heading || !heading.trim()) {
        return res.status(400).json({
          success: false,
          message: 'heading is required',
        });
      }

      const current = await teamService.getBanner();
      let imageUrl = req.body.image_url !== undefined ? (req.body.image_url || null) : (current?.image_url || null);

      const imageFile = req.files?.image?.[0] || null;
      if (imageFile) {
        try {
          imageUrl = await uploadToS3(imageFile, 'team');
          if (current?.image_url) {
            try { await deleteFromS3(current.image_url); } catch (e) { console.error('Error deleting old team banner image:', e); }
          }
        } catch (uploadError) {
          console.error('Error uploading team banner image to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message,
          });
        }
      }

      const banner = await teamService.upsertBanner({
        heading: heading.trim(),
        subtext: subtext || null,
        image_url: imageUrl,
      });

      res.status(200).json({
        success: true,
        message: 'Team page banner saved successfully',
        data: banner,
      });
    } catch (error) {
      console.error('Error saving team page banner:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving team page banner',
        error: error.message,
      });
    }
  }

  // ===== Team members =====

  async getAllMembers(req, res) {
    try {
      const members = await teamService.getAllMembers();
      res.status(200).json({
        success: true,
        message: 'Team members retrieved successfully',
        data: members,
        count: members.length,
      });
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching team members',
        error: error.message,
      });
    }
  }

  async getActiveMembers(req, res) {
    try {
      const members = await teamService.getActiveMembers();
      res.status(200).json({
        success: true,
        message: 'Team members retrieved successfully',
        data: members,
        count: members.length,
      });
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching team members',
        error: error.message,
      });
    }
  }

  async createMember(req, res) {
    try {
      const { name, role, bio, is_active } = req.body;

      if (!name || !name.trim() || !role || !role.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name and role are required',
        });
      }

      let photoUrl = req.body.photo_url || null;
      const photoFile = req.files?.photo?.[0] || null;
      if (photoFile) {
        try {
          photoUrl = await uploadToS3(photoFile, 'team');
        } catch (uploadError) {
          console.error('Error uploading team member photo to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message,
          });
        }
      }

      const member = await teamService.createMember({
        name: name.trim(),
        role: role.trim(),
        bio: bio || null,
        photo_url: photoUrl,
        is_active: is_active === undefined ? true : (is_active === true || is_active === 'true'),
      });

      res.status(201).json({
        success: true,
        message: 'Team member created successfully',
        data: member,
      });
    } catch (error) {
      console.error('Error creating team member:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating team member',
        error: error.message,
      });
    }
  }

  async updateMember(req, res) {
    try {
      const { id } = req.params;
      const current = await teamService.getMemberById(id);

      if (!current) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found',
        });
      }

      const { name, role, bio, is_active } = req.body;
      const memberData = {};

      if (name !== undefined) memberData.name = name.trim();
      if (role !== undefined) memberData.role = role.trim();
      if (bio !== undefined) memberData.bio = bio || null;
      if (is_active !== undefined) memberData.is_active = is_active === true || is_active === 'true';

      const photoFile = req.files?.photo?.[0] || null;
      if (photoFile) {
        try {
          memberData.photo_url = await uploadToS3(photoFile, 'team');
          if (current.photo_url) {
            try { await deleteFromS3(current.photo_url); } catch (e) { console.error('Error deleting old team member photo:', e); }
          }
        } catch (uploadError) {
          console.error('Error uploading team member photo to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message,
          });
        }
      } else if (req.body.photo_url !== undefined) {
        memberData.photo_url = req.body.photo_url || null;
      }

      const updatedMember = await teamService.updateMember(id, memberData);

      res.status(200).json({
        success: true,
        message: 'Team member updated successfully',
        data: updatedMember,
      });
    } catch (error) {
      console.error('Error updating team member:', error);

      if (error.message === 'Team member not found') {
        return res.status(404).json({ success: false, message: 'Team member not found' });
      }
      if (error.message === 'No fields to update') {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating team member',
        error: error.message,
      });
    }
  }

  async deleteMember(req, res) {
    try {
      const { id } = req.params;
      const result = await teamService.deleteMember(id);

      if (result.photo_url) {
        try { await deleteFromS3(result.photo_url); } catch (e) { console.error('Error deleting team member photo from S3:', e); }
      }

      res.status(200).json({
        success: true,
        message: 'Team member deleted successfully',
        data: { id: result.id, name: result.name },
      });
    } catch (error) {
      console.error('Error deleting team member:', error);

      if (error.message === 'Team member not found') {
        return res.status(404).json({ success: false, message: 'Team member not found' });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting team member',
        error: error.message,
      });
    }
  }

  async reorderMembers(req, res) {
    try {
      const { items } = req.body;
      const members = await teamService.reorderMembers(items);

      res.status(200).json({
        success: true,
        message: 'Team members reordered successfully',
        data: members,
      });
    } catch (error) {
      console.error('Error reordering team members:', error);
      res.status(500).json({
        success: false,
        message: 'Error reordering team members',
        error: error.message,
      });
    }
  }
}

module.exports = new TeamController();
