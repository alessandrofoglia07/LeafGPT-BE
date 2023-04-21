import { Schema, model } from 'mongoose';
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
const Message = model('Message', MessageSchema);
export default Message;
