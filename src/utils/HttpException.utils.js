class HttpException extends Error {
    constructor(status, message, code = null, data) {
        super(message);
        this.status = status;
        this.message = message;
        this.code = code;
        this.data = data;
    }
}

module.exports = HttpException;