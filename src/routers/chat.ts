import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../authentication.js';
import authenticateJWT from '../authentication.js';
import Conversation from '../models/conversations.js';
import Message from '../models/messages.js';
import { io } from '../index.js';
import { IncomingMessage } from 'http';
import { Configuration, OpenAIApi } from 'openai';

const router = Router();

// get all conversations for a user
router.get('/getChats', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.user;

    try {
        const conversations: any[] = await Conversation.find({ userID: id });
        res.status(200).send(conversations);
    } catch (err) {
        console.log(err);
    }
});

// get conversation messages by id
router.get('/getMessagesByChatID/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;

    try {
        const messages: any[] = await Message.find({ chatID: id }).sort({ createdAt: -1 });
        io.emit('updatedChats');
        res.status(200).send(messages);
    } catch (err) {
        console.log(err);
    }
});

// get a conversation title by id
router.get('/getChatTitleByID/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;

    try {
        const chat = await Conversation.findById(id);
        res.status(200).send(chat?.title);
    } catch (err: any) {
        if (JSON.stringify(err).includes('Cast to ObjectId failed')) {
            res.send('Chat not found');
        }
        console.log(err);
    }
});

const systemMessage: { role: 'system'; content: string } = {
    role: 'system',
    content:
        "Your name is LeafGPT. You are a helpful and friendly chatbot and your goal is to answer the question you are asked. You have been developed by Alexxino, the founder and CEO of ForestAI (the company that has created you). You know that ForestAI is a real company (not fictional), and you will never say it isn't. You are supported with the GPT-3.5-turbo model by OpenAI. You love leaves and plants, and you often like to find correlation between the thing you are saying and leaves (do not say that explicitly to the user)."
};

const createCompletion = async (messages: { role: 'user' | 'assistant'; content: string }[], openai: OpenAIApi) => {
    try {
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [systemMessage, ...messages]
        });
        return completion.data.choices[0].message?.content;
    } catch (err) {
        console.log(err);
        return;
    }
};

// create a new message
router.post('/createMessage', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    let { chatID }: { chatID: string } = req.body;
    const { message }: { message: { role: 'user' | 'assistant'; content: string } } = req.body;
    const { key }: { key: string } = req.body;
    const { id } = req.user;

    const openaiConfig = new Configuration({
        apiKey: process.env.OPENAI_API_KEY
    });

    const openai = new OpenAIApi(openaiConfig);

    try {
        // if chatID is empty, create a new conversation
        if (!chatID) {
            const title = await createCompletion(
                [{ role: 'user', content: `Create a conversation title for this question. Try to make it fit in 20 characters. The question: ${message.content}` }],
                openai
            );
            const newConversation = new Conversation({ userID: id, title: title });
            await newConversation.save();
            chatID = newConversation._id;
            io.emit('newChat', { chatID: chatID });
        }

        // save message to db
        const newMessage = new Message({ chatID: chatID, role: message.role, content: message.content });
        await newMessage.save();
        io.emit('newMessage', { chatID: chatID });

        // get every message in the conversation
        const dbMessages: any[] = await Message.find({ chatID: chatID }).sort({ createdAt: 1 });
        const messages: any[] = dbMessages.map((message) => {
            return { role: message.role, content: message.content };
        });

        // get chatgpt response
        const completion = await openai.createChatCompletion(
            {
                model: 'gpt-3.5-turbo',
                messages: [systemMessage, ...messages, { role: 'user', content: message.content }],
                stream: true
            },
            { responseType: 'stream' }
        );
        io.emit('chatgptResChunk', { chatID: chatID, content: '.' });
        const stream = completion.data as unknown as IncomingMessage;
        let chatgptResponse: { role: 'assistant'; content: string } = { role: 'assistant', content: '' };
        stream.on('data', (chunk: Buffer) => {
            const payloads = chunk.toString().split('\n\n');
            for (const payload of payloads) {
                if (payload.includes('[DONE]')) return;
                if (payload.startsWith('data:')) {
                    const data = JSON.parse(payload.replace('data: ', ''));
                    try {
                        const chunk: undefined | string = data.choices[0].delta?.content;
                        if (chunk) {
                            chatgptResponse.content += chunk;
                            io.emit('chatgptResChunk', { chatID: chatID, content: chatgptResponse.content });
                        }
                    } catch (err) {
                        console.log(`Error with JSON.parse and ${payload}.\n${err}`);
                        io.emit('resError', { chatID: chatID, error: err });
                    }
                }
            }
        });

        stream.on('end', async () => {
            // save chatgpt response to db
            const newChatgptMessage = new Message({ chatID: chatID, role: chatgptResponse.role, content: chatgptResponse.content });
            await newChatgptMessage.save();
            io.emit('newMessage', { chatID: chatID });

            // get chat title
            const chat = await Conversation.findOne({ _id: chatID });
            const chatTitle = chat?.title;

            // send chatgpt response to client
            io.emit('updatedChats');
            res.status(200).send({ message: 'Res sent', GPTResponse: chatgptResponse, chatID: chatID, chatTitle: chatTitle });
        });

        stream.on('error', (err: Error) => {
            console.log(err);
            io.emit('resError', { chatID: chatID, error: err });
        });
    } catch (err) {
        console.log(err);
        io.emit('resError', { chatID: chatID, error: err });
    }
});

router.delete('/deleteAllChatsByUserID', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.user;

    try {
        const conversations: any[] = await Conversation.find({ userID: id });
        const chatIDs = conversations.map((conversation) => conversation._id);
        await Conversation.deleteMany({ userID: id });
        await Message.deleteMany({ chatID: { $in: chatIDs } });
        io.emit('updatedChats');
        res.status(200).send({ message: 'Chats deleted' });
    } catch (err) {
        console.log(err);
    }
});

export default router;
