import { Schema, model, Document } from 'mongoose';

interface IUser {
    email: string;
    password: string;
    verified: boolean;
    verificationToken?: string;
    expiresAt?: Date;
}

interface IUserModel extends IUser, Document {}

const UserSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        },
        verified: {
            type: Boolean,
            default: false
        },
        verificationToken: {
            type: String
        },
        expiresAt: {
            type: Date,
            default: Date.now() + 24 * 60 * 60 * 1000
        }
    },
    { timestamps: true }
);

UserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { verified: { $ne: true } } });

const User = model<IUserModel>('User', UserSchema);

export default User;
