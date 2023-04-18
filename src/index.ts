import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/users.js';
import Message from './models/messages.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const URI = process.env.ATLAS_URI as string;
const PORT = process.env.PORT || 5000;

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
        console.log('Connected to MongoDB');
        app.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
    } catch (err) {
        console.log(err);
    }
};
connectToDB();

const sendEmail = async (to: string, subject: string, text: string) => {
    const mailOptions = {
        from: process.env.DEFAULT_EMAIL,
        to: to,
        subject: subject,
        text: text
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent ' + info.response);
    } catch (err) {
        console.log(err);
    }
};

app.post('/api/auth/sendVerificationEmail', async (req: Request, res: Response) => {
    const { email, password }: { email: string, password: string; } = req.body;
    const verificationToken = uuidv4();

    try {
        const emailAlreadyRegistered = await User.findOne({ email });
        if (emailAlreadyRegistered) {
            res.send({ message: 'Email already registered' });
            return;
        }
        const newUser = new User({ email, password, verificationToken });
        await newUser.save();
        sendEmail(email, 'Verify your email', `Click on this link to verify your email http://localhost:3000/auth/verify/${verificationToken}`);
        res.status(200).send({ message: 'Verification email sent' });
    } catch (err) {
        console.log(err);
    }
});

const verifyEmail = async (verificationToken: string) => {
    try {
        const user = await User.findOne({ verificationToken });
        if (!user) {
            return 'Invalid token';
        }
        if (user.verified) {
            return 'Email already verified';
        }
        await User.updateOne({ verificationToken }, { verified: true });
        return 'Email verified';
    } catch (err) {
        console.log(err);
        return 'Server error';
    }
};

app.get('/api/auth/verify/:verificationToken', async (req: Request, res: Response) => {
    const { verificationToken } = req.params;
    const message = await verifyEmail(verificationToken);
    res.send({ message: message });
});
