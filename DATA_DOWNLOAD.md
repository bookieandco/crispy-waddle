# Dataset download

This repository references a large ZIP file (4 GB) that is stored on Google Drive rather than in the Git repository.

Links

- Google Drive view link: https://drive.google.com/file/d/1jxSOrQ1tN3BeqC9Z0h6Ua85fHBCVVepr/view?usp=drivesdk
- Direct download link: https://drive.google.com/uc?export=download&id=1jxSOrQ1tN3BeqC9Z0h6Ua85fHBCVVepr

Notes

- The ZIP is too large to store directly in this GitHub repository. Use the direct download link to fetch the archive.
- Example: download with curl

  curl -L -o mydataset.zip "https://drive.google.com/uc?export=download&id=1jxSOrQ1tN3BeqC9Z0h6Ua85fHBCVVepr"

- If Google shows a confirmation page for large files, download via the web UI or use a tool/script that handles Drive large-file confirmations.

If you want, I can also add a small download script (scripts/download_dataset.sh) or create a release note referencing this asset.