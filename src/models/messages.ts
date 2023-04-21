import { Schema, model, Document } from 'mongoose';

interface IMessage {
    chatID: string;
    author: 'user' | 'bot';
    content: string;
}

interface IMessageModel extends IMessage, Document { }

const MessageSchema = new Schema({
    chatID: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const Message = model<IMessageModel>('Message', MessageSchema);

export default Message;