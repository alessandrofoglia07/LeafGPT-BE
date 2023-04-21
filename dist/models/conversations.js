import { Schema, model } from 'mongoose';
const ConversationSchema = new Schema({
    userID: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
}, { timestamps: true });
const Conversation = model('Conversation', ConversationSchema);
export default Conversation;
