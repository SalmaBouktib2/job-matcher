console.log("Script loaded");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    const matchForm = document.getElementById('matchForm');
    if (!matchForm) {
        console.error("Form with id 'matchForm' not found!");
        return;
    }
    console.log("Form found:", matchForm);

    matchForm.addEventListener('submit', async (e) => {
        console.log("Form submitted");
        e.preventDefault();
        console.log("Default form submission prevented");

        const resumeFileInput = document.getElementById('resumeFile');
        const jobDescriptionTextarea = document.getElementById('jobDescription');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.querySelector('.btn-text');
        const loader = document.querySelector('.loader');
        const resultsDiv = document.getElementById('results');
        const matchPercentageSpan = document.getElementById('matchPercentage');
        const missingSkillsList = document.getElementById('missingSkills');
        const errorMessageDiv = document.getElementById('errorMessage');
        const CLOUD_FUNCTION_URL = "https://europe-west1-project-processing-475110.cloudfunctions.net/match-resume";

        const resumeFile = resumeFileInput.files[0];
        const jobDescriptionText = jobDescriptionTextarea.value;

        if (!resumeFile || !jobDescriptionText) {
            console.log("Resume file or job description is missing.");
            alert('Please upload a resume and paste a job description.');
            return;
        }
        console.log("Resume file and job description are present.");

        resultsDiv.classList.add('hidden');
        errorMessageDiv.classList.add('hidden');
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        submitBtn.disabled = true;
        console.log("UI updated for loading state.");

        try {
            console.log("Converting file to base64...");
            const resumeB64 = await fileToBase64(resumeFile);
            console.log("File converted to base64.");

            console.log("Sending request to cloud function...");
            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resume_b64: resumeB64,
                    resume_filename: resumeFile.name,
                    job_description_text: jobDescriptionText,
                }),
            });
            console.log("Response received from cloud function.");

            const data = await response.json();

            if (!response.ok) {
                console.error("Server error:", data.error);
                errorMessageDiv.textContent = data.error || `Server error: ${response.status}`;
                errorMessageDiv.classList.remove('hidden');
                return;
            }

            console.log("Updating UI with results...");
            matchPercentageSpan.textContent = `${data.match_percentage}%`;

            missingSkillsList.innerHTML = '';
            if (data.missing_skills && data.missing_skills.length > 0) {
                data.missing_skills.slice(0, 5).forEach(skill => {
                    const li = document.createElement('li');
                    li.textContent = skill;
                    missingSkillsList.appendChild(li);
                });
            } else {
                missingSkillsList.innerHTML = '<li>No significant missing skills identified.</li>';
            }

            resultsDiv.classList.remove('hidden');
            console.log("UI updated with results.");

        } catch (error) {
            console.error('Error:', error);
            errorMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
            errorMessageDiv.classList.remove('hidden');
        } finally {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            submitBtn.disabled = false;
            console.log("UI restored from loading state.");
        }
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });
    }
});