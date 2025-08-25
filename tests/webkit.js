import { webkit } from "playwright";

(async () => {
	const browser = await webkit.launch({ headless: false });
	const context = await browser.newContext();

	const page = await context.newPage();

	// Navigate to your local website
	await page.goto("http://localhost:5173");

	// Wait for the file input to be visible
	const fileInputSelector = 'input[type="file"]'; // Update selector if necessary
	await page.waitForSelector(fileInputSelector);

	// Path to the file you want to upload
	const filePath = "./tests/TestSave"; // Use an absolute path

	// Upload the file by setting it directly on the input element
	const [fileChooser] = await Promise.all([
		page.waitForEvent("filechooser"), // Wait for the file chooser to be triggered
		page.click(fileInputSelector), // Click the file input to trigger the file chooser
	]);

	await fileChooser.setFiles(filePath);
})();
