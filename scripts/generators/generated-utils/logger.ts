import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

const logsDir = path.resolve(process.cwd(), 'logs')
const logFilePath = path.join(logsDir, 'server.log')

export async function writeLog(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown> = {}
) {
    if (!fs.existsSync(logFilePath)) {
        fs.mkdirSync(logsDir, { recursive: true })
        fs.writeFileSync(logFilePath, '', 'utf8')
    }

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
    }
    const line = JSON.stringify(entry)

    if (level === 'ERROR') {
        console.error(line)
    } else {
        console.log(line)
    }

    try {
        await fs.promises.appendFile(logFilePath, `${line}\n`, 'utf8')
    } catch (error) {
        console.error(
            'Failed to write log file entry:',
            error instanceof Error ? error.message : error
        )
    }
}
