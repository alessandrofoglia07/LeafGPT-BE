import jwt from 'jsonwebtoken';
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.sendStatus(401);
        return;
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            res.sendStatus(403);
            console.log('Authentication error: ' + err);
            return;
        }
        req.user = user;
        next();
    });
};
export default authenticateJWT;
