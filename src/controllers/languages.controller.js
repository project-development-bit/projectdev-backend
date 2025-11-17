const fs = require("fs");
const path = require("path");
const HttpException = require("../utils/HttpException.utils");

class LanguagesController {
  //Get all supported languages
  getAllLanguages = async (req, res, next) => {
    try {
      const languagesFilePath = path.join(__dirname, "../config/language.json");

      // Check if file exists
      if (!fs.existsSync(languagesFilePath)) {
        throw new HttpException(500, "Unable to load languages file.");
      }

      // Read and parse the file
      const fileContent = fs.readFileSync(languagesFilePath, "utf8");
      const languages = JSON.parse(fileContent);

      // Validate it's an array
      if (!Array.isArray(languages)) {
        throw new HttpException(500, "Unable to load languages file.");
      }

      res.status(200).json({
        success: true,
        languages: languages
      });
    } catch (error) {
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return next(new HttpException(500, "Unable to load languages file."));
      }

      next(error);
    }
  };

}

module.exports = new LanguagesController();
