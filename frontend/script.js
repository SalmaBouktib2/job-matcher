document.addEventListener('DOMContentLoaded', () => {
    const resumeFileInput = document.getElementById('resumeFile');
    const jobDescriptionTextarea = document.getElementById('jobDescription');
    const submitBtn = document.getElementById('submitBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsDiv = document.getElementById('results');
    const matchPercentageSpan = document.getElementById('matchPercentage');
    const matchedSkillsList = document.getElementById('matchedSkills');
    const missingSkillsList = document.getElementById('missingSkills');
    const errorMessageDiv = document.getElementById('errorMessage');

    // --- IMPORTANT: REPLACE WITH YOUR CLOUD FUNCTION URL ---
    const CLOUD_FUNCTION_URL = "YOUR_CLOUD_FUNCTION_URL_FROM_TERRAFORM_OUTPUT";
    // --- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ---

    submitBtn.addEventListener('click', async () => {
        const resumeFile = resumeFileInput.files[0];
        const jobDescriptionText = jobDescriptionTextarea.value;

        if (!resumeFile || !jobDescriptionText) {
            alert('Please upload a resume and paste a job description.');
            return;
        }

        resultsDiv.classList.add('hidden');
        errorMessageDiv.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            const resumeB64 = await fileToBase64(resumeFile);

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

            const data = await response.json();

            if (!response.ok) {
                errorMessageDiv.textContent = data.error || `Server error: ${response.status}`;
                errorMessageDiv.classList.remove('hidden');
                return;
            }

            matchPercentageSpan.textContent = `${data.match_percentage}%`;

            matchedSkillsList.innerHTML = '';
            if (data.matched_skills && data.matched_skills.length > 0) {
                data.matched_skills.forEach(skill => {
                    const li = document.createElement('li');
                    li.textContent = skill;
                    matchedSkillsList.appendChild(li);
                });
            } else {
                 matchedSkillsList.innerHTML = '<li>No significant matched skills found.</li>';
            }


            missingSkillsList.innerHTML = '';
            if (data.missing_skills && data.missing_skills.length > 0) {
                data.missing_skills.forEach(skill => {
                    const li = document.createElement('li');
                    li.textContent = skill;
                    missingSkillsList.appendChild(li);
                });
            } else {
                missingSkillsList.innerHTML = '<li>No significant missing skills identified.</li>';
            }


            resultsDiv.classList.remove('hidden');

        } catch (error) {
            console.error('Error:', error);
            errorMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
            errorMessageDiv.classList.remove('hidden');
        } finally {
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Extract base64 part (after "data:mime/type;base64,")
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });
    }
});