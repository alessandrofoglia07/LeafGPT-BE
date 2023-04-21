import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/users.js';
import Conversation from './models/conversations.js';
import Message from './models/messages.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import authenticateJWT from './authentication.js';
import { Configuration, OpenAIApi } from "openai";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const URI = process.env.ATLAS_URI;
const PORT = process.env.PORT || 5000;
const SALT_ROUNDS = 10;
const openaiConfig = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);
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
        app.listen(PORT, () => console.log('\x1b[36m', `-- Server is running on port: ${PORT}`));
    }
    catch (err) {
        console.log(err);
    }
};
connectToDB();
const sendEmail = async (to, subject, text) => {
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
const createCompletion = async (messages) => {
    try {
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: messages,
        });
        return completion.data.choices[0].message?.content;
    }
    catch (err) {
        console.log(err);
        return;
    }
};
app.post('/api/auth/sendVerificationEmail', async (req, res) => {
    const { email, password } = req.body;
    const verificationToken = uuidv4();
    try {
        const emailAlreadyRegistered = await User.findOne({ email });
        if (emailAlreadyRegistered) {
            res.send({ message: 'Email already registered' });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const newUser = new User({ email, password: hashedPassword, verificationToken });
        await newUser.save();
        sendEmail(email, 'Verify your email', `Click on this link to verify your email http://localhost:3000/auth/verify/${verificationToken}`);
        res.status(200).send({ message: 'Verification email sent' });
    }
    catch (err) {
        console.log(err);
    }
});
const verifyEmail = async (verificationToken) => {
    try {
        const user = await User.findOne({ verificationToken });
        if (!user) {
            return 'Your token is invalid. Please register again';
        }
        if (user.verified) {
            return 'Your email is already verified. Go to login';
        }
        if (user.expiresAt && user.expiresAt < Date.now()) {
            return 'Your token is expired. Please register again';
        }
        await User.updateOne({ verificationToken }, { verified: true });
        return 'Your email has been verified. Welcome to ForestAI!';
    }
    catch (err) {
        console.log(err);
        return 'Server error';
    }
};
app.get('/api/auth/verify/:verificationToken', async (req, res) => {
    const { verificationToken } = req.params;
    const message = await verifyEmail(verificationToken);
    res.send({ message: message });
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            res.send({ message: 'Email not registered' });
            return;
        }
        if (!user.verified) {
            res.send({ message: 'Email not verified' });
            return;
        }
        if (!(await bcrypt.compare(password, user.password))) {
            res.send({ message: 'Incorrect password' });
            return;
        }
        const id = user._id;
        const token = jwt.sign({ id: id, email: email }, process.env.JWT_SECRET);
        res.status(200).send({ message: 'Login successful', token: token, id: id, email: email });
    }
    catch (err) {
        console.log(err);
        res.send({ message: 'Server error' });
    }
});
// get all conversations for a user
app.get('/api/chat/getChats', authenticateJWT, async (req, res) => {
    const { id } = req.user;
    try {
        const conversations = await Conversation.find({ userID: id });
        res.status(200).send(conversations);
    }
    catch (err) {
        console.log(err);
    }
});
// get a conversation by id
app.get('api/chat/getMessagesByChatID/:chatId', authenticateJWT, async (req, res) => {
    const { chatId } = req.params;
    try {
        const messages = await Message.find({ conversationID: chatId }).sort({ createdAt: -1 });
        res.status(200).send(messages);
    }
    catch (err) {
        console.log(err);
    }
});
// create a new message
app.post('/api/chat/createMessage', authenticateJWT, async (req, res) => {
    let { chatID } = req.body;
    const { message } = req.body;
    const { id } = req.user;
    try {
        // if chatID is empty, create a new conversation
        // TODO solve bug
        if (!chatID) {
            console.log('\x1b[33m', 1);
            const title = await createCompletion([{ role: 'user', content: `Create a conversation title for this question. It must have no more than 30 characters. The question: "${message.content}"` }]);
            const newConversation = new Conversation({ userID: id, title: title });
            await newConversation.save();
            chatID = newConversation._id;
            console.log('\x1b[33m', 2);
        }
        ;
        const newMessage = new Message({ chatID: chatID, author: message.author, content: message.content });
        await newMessage.save();
        console.log('\x1b[33m', 3);
        // get every message in the conversation
        const dbMessages = await Message.find({ conversationID: chatID }).sort({ createdAt: -1 });
        const messages = dbMessages.map((message) => {
            return { role: message.author, content: message.content };
        });
        console.log('\x1b[33m', 4);
        // get chatgpt response
        const completion = await createCompletion(messages);
        const chatgptResponse = { role: 'assistant', content: completion };
        console.log('\x1b[33m', 5);
        // save chatgpt response to db
        const newChatgptMessage = new Message({ chatID: chatID, author: chatgptResponse.role, content: chatgptResponse.content });
        await newChatgptMessage.save();
        console.log('\x1b[33m', 6);
        // send chatgpt response to client
        res.status(200).send(chatgptResponse);
        console.log('\x1b[33m', 7);
    }
    catch (err) {
        console.log(err);
    }
});
