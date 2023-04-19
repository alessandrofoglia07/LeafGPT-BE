import { Schema, model } from 'mongoose';
const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    verificationToken: {
        type: String,
    },
    expiresAt: {
        type: Number,
        default: Date.now() + 24 * 60 * 60 * 1000,
    },
}, { timestamps: true });
const User = model('User', UserSchema);
export default User;
