// This is raw-code inside the server file

// @ts-ignore app and express is supplied by the generated server file
app.post('/api/sub', [express.json()], async (req: any, res: any) => {
    try {
        const args = (req.body ?? {}) as { a: number; b: number }

        const missingParams = ['a', 'b'].filter((name) => !(name in args))

        if (missingParams.length > 0) {
            // @ts-ignore res is supplied by the generated server file
            res.status(400).json({ error: 'Missing params', missingParams })
            return
        }

        const result = args.a - args.b
        res.json({ result })
    } catch (error) {
        // @ts-ignore res is supplied by the generated server file
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
        })
    }
})
