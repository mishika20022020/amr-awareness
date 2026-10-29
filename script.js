
/* ==============================
   AMR Awareness Website
   Main JavaScript
   ============================== */

document.addEventListener("DOMContentLoaded", () => {
    initializeMainTabs();
    initializeAboutSubtabs();
    initializeCheckpointGallery();
});

/* ---------- Main navigation tabs ---------- */

function initializeMainTabs() {
    const tabButtons = document.querySelectorAll("[data-tab]");
    const tabSections = document.querySelectorAll(".tab-content");

    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.tab;
            const targetSection = document.getElementById(targetId);

            if (!targetSection) {
                console.warn(`Tab content not found: ${targetId}`);
                return;
            }

            tabButtons.forEach((item) => {
                item.classList.remove("active");
                item.setAttribute("aria-selected", "false");
            });

            tabSections.forEach((section) => {
                section.classList.remove("active");
                section.hidden = true;
            });

            button.classList.add("active");
            button.setAttribute("aria-selected", "true");

            targetSection.classList.add("active");
            targetSection.hidden = false;
        });
    });

    // Show the selected tab on initial page load.
    const activeButton =
        document.querySelector("[data-tab].active") ||
        tabButtons[0];

    if (activeButton) {
        activeButton.click();
    } else {
        // Also support pages that use only .tab-content classes.
        const activeSection =
            document.querySelector(".tab-content.active") ||
            tabSections[0];

        tabSections.forEach((section) => {
            section.hidden = section !== activeSection;
            section.classList.toggle("active", section === activeSection);
        });
    }
}

/* ---------- Optional About AMR subtabs ---------- */

function initializeAboutSubtabs() {
    const subtabButtons = document.querySelectorAll("[data-subtab]");
    const subtabSections = document.querySelectorAll(".subtab-content");

    subtabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.subtab;
            const targetSection = document.getElementById(targetId);

            if (!targetSection) return;

            subtabButtons.forEach((item) => {
                item.classList.remove("active");
                item.setAttribute("aria-selected", "false");
            });

            subtabSections.forEach((section) => {
                section.classList.remove("active");
                section.hidden = true;
            });

            button.classList.add("active");
            button.setAttribute("aria-selected", "true");

            targetSection.classList.add("active");
            targetSection.hidden = false;
        });
    });
}

/* ---------- Checkpoint photo gallery ---------- */

function initializeCheckpointGallery() {
    const fileInput = document.getElementById("checkpoint-files");
    const gallery = document.getElementById("checkpoint-gallery");
    const emptyMessage = document.getElementById("empty-gallery");
    const status = document.getElementById("upload-status");
    const photoCount = document.getElementById("photo-count");

    // The upload feature is optional; other pages can still run without it.
    if (!fileInput || !gallery) return;

    const DATABASE_NAME = "AMRCheckpointGallery";
    const STORE_NAME = "photos";
    let database = null;

    function showStatus(message, isError = false) {
        if (!status) return;

        status.textContent = message;
        status.style.color = isError ? "#b42318" : "";
        status.setAttribute("role", "status");
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!("indexedDB" in window)) {
                reject(new Error("This browser does not support local photo storage."));
                return;
            }

            const request = indexedDB.open(DATABASE_NAME, 1);

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, {
                        keyPath: "id",
                        autoIncrement: true
                    });
                }
            };

            request.onsuccess = () => {
                database = request.result;

                database.onversionchange = () => {
                    database.close();
                    database = null;
                };

                resolve(database);
            };

            request.onerror = () => {
                reject(request.error || new Error("Could not open photo storage."));
            };

            request.onblocked = () => {
                reject(new Error(
                    "Photo storage is busy. Close other AMR website tabs and try again."
                ));
            };
        });
    }

    function getAllPhotos() {
        return new Promise((resolve, reject) => {
            if (!database) {
                reject(new Error("Photo storage is not available."));
                return;
            }

            const transaction = database.transaction(STORE_NAME, "readonly");
            const request = transaction.objectStore(STORE_NAME).getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    function savePhoto(photo) {
        return new Promise((resolve, reject) => {
            if (!database) {
                reject(new Error("Photo storage is not available."));
                return;
            }

            const transaction = database.transaction(STORE_NAME, "readwrite");
            const request = transaction.objectStore(STORE_NAME).add(photo);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function removePhoto(id) {
        return new Promise((resolve, reject) => {
            if (!database) {
                reject(new Error("Photo storage is not available."));
                return;
            }

            const transaction = database.transaction(STORE_NAME, "readwrite");
            const request = transaction.objectStore(STORE_NAME).delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function createPhotoCard(photo) {
        const card = document.createElement("article");
        card.className = "photo-card";

        const image = document.createElement("img");
        image.alt = photo.name || "Uploaded checkpoint photo";
        image.loading = "lazy";

        const imageUrl = URL.createObjectURL(photo.blob);
        image.src = imageUrl;

        // Release the temporary preview URL when the image is removed.
        image.addEventListener("load", () => {
            URL.revokeObjectURL(imageUrl);
        }, { once: true });

        const info = document.createElement("div");
        info.className = "photo-info";

        const name = document.createElement("p");
        name.className = "photo-name";
        name.textContent = photo.name || "Untitled photo";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-photo-button";
        deleteButton.textContent = "Delete photo";
        deleteButton.setAttribute(
            "aria-label",
            `Delete ${photo.name || "photo"}`
        );

        deleteButton.addEventListener("click", async () => {
            const confirmed = window.confirm(
                `Delete "${photo.name || "this photo"}" from this browser?`
            );

            if (!confirmed) return;

            deleteButton.disabled = true;

            try {
                await removePhoto(photo.id);
                await renderGallery();
                showStatus("Photo deleted.");
            } catch (error) {
                console.error(error);
                showStatus("Unable to delete this photo. Please try again.", true);
                deleteButton.disabled = false;
            }
        });

        info.append(name, deleteButton);
        card.append(image, info);

        return card;
    }

    async function renderGallery() {
        const photos = await getAllPhotos();

        gallery.replaceChildren();

        if (photoCount) {
            photoCount.textContent =
                `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`;
        }

        if (emptyMessage) {
            emptyMessage.hidden = photos.length > 0;

            if (photos.length === 0) {
                gallery.appendChild(emptyMessage);
            }
        } else if (photos.length === 0) {
            const message = document.createElement("div");
            message.className = "empty-gallery";
            message.textContent = "No photos yet. Upload photos to get started.";
            gallery.appendChild(message);
        }

        photos
            .sort((a, b) => b.id - a.id)
            .forEach((photo) => {
                gallery.appendChild(createPhotoCard(photo));
            });
    }

    fileInput.addEventListener("change", async () => {
        const files = Array.from(fileInput.files || []);

        if (files.length === 0) return;

        const imageFiles = files.filter((file) =>
            file.type.startsWith("image/")
        );

        if (imageFiles.length !== files.length) {
            showStatus("Only image files are supported. Non-image files were skipped.", true);
        }

        const MAX_FILE_SIZE = 15 * 1024 * 1024;
        const acceptedFiles = imageFiles.filter((file) => {
            if (file.size > MAX_FILE_SIZE) {
                showStatus(
                    `"${file.name}" exceeds the 15 MB per-photo limit and was skipped.`,
                    true
                );
                return false;
            }

            return true;
        });

        if (acceptedFiles.length === 0) {
            fileInput.value = "";
            return;
        }

        fileInput.disabled = true;
        let savedCount = 0;

        try {
            if (!database) {
                await openDatabase();
            }

            for (const file of acceptedFiles) {
                await savePhoto({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                    blob: file
                });

                savedCount++;
            }

            await renderGallery();

            if (savedCount > 0) {
                showStatus(
                    `${savedCount} ${savedCount === 1 ? "photo was" : "photos were"} saved in this browser.`
                );
            }
        } catch (error) {
            console.error("Checkpoint photo upload failed:", error);

            showStatus(
                "Photos could not be saved. Your browser storage may be unavailable or full.",
                true
            );
        } finally {
            fileInput.disabled = false;
            fileInput.value = "";
        }
    });

    // Load previously saved photos when the page opens.
    openDatabase()
        .then(() => renderGallery())
        .then(() => {
            showStatus("Your saved checkpoint photos are ready.");
        })
        .catch((error) => {
            console.error("Checkpoint gallery initialization failed:", error);

            showStatus(
                "Local photo storage could not be opened. Check your browser settings and try again.",
                true
            );
        });
}
