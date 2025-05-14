import request from "supertest";
import app from "../../app"; // Ajuste o caminho para o seu arquivo app.ts principal

describe("Health Check API", () => {
    it("should return 200 OK and status UP for /health", async () => {
        const res = await request(app).get("/health");
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("status", "UP");
        expect(res.body).toHaveProperty("timestamp");
    });

    it("should return 200 OK for API root /api/v1", async () => {
        const res = await request(app).get("/api/v1");
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("message", "ForumMed API is running!");
    });
});

