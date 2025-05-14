declare module '../../utils/errors' {
    export class AppError extends Error {
        public readonly statusCode: number;
        constructor(message: string, statusCode?: number);
        static badRequest(message: string): AppError;
        static unauthorized(message: string): AppError;
        static forbidden(message: string): AppError;
        static notFound(message: string): AppError;
        static conflict(message: string): AppError;
    }
}

