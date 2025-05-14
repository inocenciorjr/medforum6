import { Router } from "express";
import articleRoutes from "./articleRoutes";
import commentRoutes from "./commentRoutes";
import questionRoutes from "./questionRoutes";
import userQuestionHistoryRoutes from "./userQuestionHistoryRoutes";
import mentorshipRoutes from "./mentorshipRoutes";
import adminRoutes from "./adminRoutes";
// Import other new route modules as they are created (e.g., payment, plan, user, auth)

const router = Router();

router.use("/articles", articleRoutes);
router.use("/comments", commentRoutes);
router.use("/questions", questionRoutes);
router.use("/history", userQuestionHistoryRoutes);
router.use("/mentorships", mentorshipRoutes);
router.use("/admin", adminRoutes);

// Placeholder for health check or API root
router.get("/", (req, res) => {
    res.status(200).json({ message: "ForumMed API is running!" });
});

export default router;

