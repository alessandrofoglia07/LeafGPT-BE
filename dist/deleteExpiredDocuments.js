import User from './models/users.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
// runs every half hour
setInterval(async () => {
    try {
        await mongoose.connect(process.env.ATLAS_URI);
        console.log('\x1b[33m', 'Checking for expired users...');
        const expiredUsers = await User.find({ verified: false, expiresAt: { $lte: Date.now() } });
        if (expiredUsers.length > 0) {
            for (const user of expiredUsers) {
                await User.deleteOne({ _id: user._id });
                console.log('\x1b[33m', 'Deleted user with email: ' + user.email);
            }
        }
        else {
            console.log('\x1b[33m', 'No expired users');
        }
    }
    catch (err) {
        console.log(err);
    }
    finally {
        await mongoose.connection.close();
    }
}, 30 * 60 * 1000);
