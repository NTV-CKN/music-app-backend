const admin = require("firebase-admin");

async function moveTempFileToDest(tempInput, destinationFolder, songId) {
    if (!tempInput || typeof tempInput !== 'string') return tempInput;

    const bucket = admin.storage().bucket();
    let tempPath = tempInput;

    if (tempInput.includes("temp_storage")) {
        const decoded = decodeURIComponent(tempInput);
        const match = decoded.match(/temp_storage\/[^?#]+/);
        if (match) {
            tempPath = match[0];
        }
    }

    if (!tempPath.startsWith("temp_storage/")) {
        console.log("File không thuộc temp_storage, bỏ qua:", tempInput);
        return tempInput;
    }

    const tempFile = bucket.file(tempPath);
    const [exists] = await tempFile.exists();
    if (!exists) {
        console.log("File không tồn tại trên Cloud Storage:", tempPath);
        return tempInput;
    }

    const extMatch = tempPath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[0] : "";

    const destinationPath = `${destinationFolder}/${songId}_${Date.now()}${ext}`;
    const destinationFile = bucket.file(destinationPath);

    await tempFile.copy(destinationFile);
    await tempFile.delete();

    await destinationFile.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
}

function extractStoragePath(fileUrlOrPath) {
    if (!fileUrlOrPath || typeof fileUrlOrPath !== "string") return null;

    const trimmed = fileUrlOrPath.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return trimmed;
    }

    try {
        const decodedUrl = decodeURIComponent(trimmed);
        if (decodedUrl.includes("storage.googleapis.com")) {
            const afterDomain = decodedUrl.split("storage.googleapis.com/")[1];
            if (afterDomain) {
                const parts = afterDomain.split("/");
                parts.shift();
                return parts.join("/").split("?")[0]; 
            }
        }
        if (decodedUrl.includes("/o/")) {
            const pathWithQuery = decodedUrl.split("/o/")[1];
            if (pathWithQuery) {
                return pathWithQuery.split("?")[0];
            }
        }
    } catch (error) {
        console.error("Lỗi parse URL Storage:", error);
    }

    return null;
}

async function deleteFileFromStorage(fileUrlOrPath) {
    try {
        const filePath = extractStoragePath(fileUrlOrPath);

        if (!filePath) {
            return {
                success: false,
                message: "Đường dẫn file không hợp lệ hoặc rỗng."
            };
        }

        const bucket = admin.storage().bucket();
        const file = bucket.file(filePath);

        const [exists] = await file.exists();
        if (!exists) {
            return {
                success: true,
                message: "File không tồn tại trên Storage (có thể đã bị xóa trước đó)."
            };
        }

        await file.delete();

        return {
            success: true,
            message: `Đã xóa file "${filePath}" thành công.`
        };

    } catch (error) {
        console.error("Lỗi khi xóa file trên Cloud Storage:", error);
        return {
            success: false,
            message: "Lỗi hệ thống khi xóa file: " + error.message
        };
    }
}

module.exports = {
    moveTempFileToDest, deleteFileFromStorage
}