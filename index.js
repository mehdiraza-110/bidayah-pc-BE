const express = require('express');
const app = express();
const dotenv = require('dotenv');
const routes = require('./routes/v1/routes');
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require('./config/db.config');

dotenv.config();

// Blog/news content is rich-text HTML and can embed base64 images from the
// editor, so the 100kb default body limit rejects ordinary posts.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const corsOptions = {
    origin: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions))
app.use(cookieParser());

app.use("/api/v1", routes);

// Body-parser / multer failures would otherwise return an HTML error page,
// which the admin UI can't parse.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
    console.error('Request error:', err.message);
    res.status(status).json({ success: false, message: err.message || 'Request failed' });
});


app.listen(process.env.PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
