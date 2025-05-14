module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testMatch: [
        "**/__tests__/**/*.+(ts|tsx|js)",
        "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    },
    // Automatically clear mock calls and instances between every test
    clearMocks: true,
    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",
    // Indicates which provider Docusaurus uses to instrument code for coverage
    coverageProvider: "v8", // or "babel"
    // A list of paths to modules that run some code to configure or set up the testing environment before each test
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"], // if you have a setup file
};
