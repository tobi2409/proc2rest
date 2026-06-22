// This is raw-code inside the server file
app.post("/api/sub", [express.json()], async (req: Request, res: Response) => {
    try {
        const args = req.body ?? {};

        const missingParams = ["a", "b"].filter((name) => !(name in args));

        if (missingParams.length > 0) {
            res.status(400).json({ error: "Missing params", missingParams });
            return;
        }

        const result = args.a - args.b;
        res.json({ result });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
