import { Schema, model, Document } from 'mongoose';

interface IUser {
    email: string;
    password: string;
    verified: boolean;
    verificationToken?: string;
}

interface IUserModel extends IUser, Document { }

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
}, { timestamps: true });

const User = model<IUserModel>('User', UserSchema);

export default User;