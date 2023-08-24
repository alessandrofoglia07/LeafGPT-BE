import Router, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/users.js';
import { sendEmail } from '../index.js';

const router = Router();

const SALT_ROUNDS = 10;

router.post('/sendVerificationEmail', async (req: Request, res: Response) => {
    const { email, password }: { email: string; password: string } = req.body;
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
    } catch (err) {
        console.log(err);
    }
});

const verifyEmail = async (verificationToken: string) => {
    try {
        const user = await User.findOne({ verificationToken });
        if (!user) {
            return 'Your token is invalid. Please register again';
        }
        if (user.verified) {
            return 'Your email is already verified. Go to login';
        }
        if (user.expiresAt && user.expiresAt < new Date(Date.now())) {
            return 'Your token is expired. Please register again';
        }
        await User.updateOne({ verificationToken }, { verified: true });
        return 'Your email has been verified. Welcome to ForestAI!';
    } catch (err) {
        console.log(err);
        return 'Server error';
    }
};

router.get('/verify/:verificationToken', async (req: Request, res: Response) => {
    const { verificationToken } = req.params;
    const message = await verifyEmail(verificationToken);
    res.send({ message: message });
});

router.post('/login', async (req: Request, res: Response) => {
    const { email, password }: { email: string; password: string } = req.body;

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
        const token = jwt.sign({ id: id, email: email }, process.env.JWT_SECRET as string);
        res.status(200).send({ message: 'Login successful', token: token, id: id, email: email });
    } catch (err) {
        console.log(err);
        res.send({ message: 'Server error' });
    }
});

export default router;
