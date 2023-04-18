import { Schema, model, Document } from 'mongoose';

interface IMessage {
    userID: number;
    room: string;
    author: string;
    message: string;
}

interface IMessageModel extends IMessage, Document { }

const MessageSchema = new Schema({
    userID: {
        type: Number,
        required: true,
    },
    room: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const Message = model<IMessageModel>('Message', MessageSchema);

export default Message;