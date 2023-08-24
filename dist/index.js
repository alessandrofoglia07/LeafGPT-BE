import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Configuration, OpenAIApi } from 'openai';
import http from 'http';
import { Server } from 'socket.io';
import authRouter from './routers/auth.js';
import chatRouter from './routers/chat.js';
import adminRouter from './routers/admin.js';
dotenv.config();
const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);
const URI = process.env.ATLAS_URI;
const PORT = process.env.PORT || 5000;
const openaiConfig = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
});
export const openai = new OpenAIApi(openaiConfig);
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.DEFAULT_EMAIL,
        pass: process.env.DEFAULT_PASSWORD
    }
});
const connectToDB = async () => {
    try {
        await mongoose.connect(URI);
        console.log('\x1b[36m', '-- Connected to MongoDB');
        server.listen(PORT, () => console.log('\x1b[36m', `-- Server is running on port: ${PORT}`));
    }
    catch (err) {
        console.log(err);
    }
};
connectToDB();
export const sendEmail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.DEFAULT_EMAIL,
        to: to,
        subject: subject,
        text: text
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent ' + info.response);
    }
    catch (err) {
        console.log(err);
    }
};
app.all('*', (req, res) => {
    res.sendStatus(404);
});
