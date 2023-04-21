import { Schema, model, Document } from 'mongoose';

interface IConversation {
    userID: string;
    title: string;
}

interface IConversationModel extends IConversation, Document { }

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

const Conversation = model<IConversationModel>('Conversation', ConversationSchema);

export default Conversation;