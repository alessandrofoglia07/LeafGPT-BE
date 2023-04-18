import { Schema, model } from 'mongoose';
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
const Message = model('Message', MessageSchema);
export default Message;
