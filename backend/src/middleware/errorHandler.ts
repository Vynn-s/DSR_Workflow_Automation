import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
	statusCode: number;
	isOperational: boolean;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.isOperational = true;

		Object.setPrototypeOf(this, AppError.prototype);
	}
}

export function errorHandler(
	err: Partial<Error> & { statusCode?: number },
	_req: Request,
	res: Response,
	_next: NextFunction,
) {
	const statusCode = err.statusCode ?? 500;
	console.error(err.stack ?? err.message ?? err);

	const message =
		statusCode >= 500
			? "Internal Server Error"
			: err.message ?? "Request failed";

	res.status(statusCode).json({
		success: false,
		error: {
			message,
			statusCode,
		},
	});
}

export default errorHandler;
