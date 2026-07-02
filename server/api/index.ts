// Vercel serverless-энтрипоинт. Экспортирует Express-приложение как хендлер.
// index.ts при process.env.VERCEL не слушает порт и не поллит — только отдаёт app.
import app from '../src/index.ts'

export default app
