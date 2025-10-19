document.addEventListener('DOMContentLoaded', () => {
    const matchForm = document.getElementById('matchForm');
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

    matchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const resumeFile = resumeFileInput.files[0];
        const jobDescriptionText = jobDescriptionTextarea.value;

        if (!resumeFile || !jobDescriptionText) {
            alert('Please upload a resume and paste a job description.');
            return;
        }

        resultsDiv.classList.add('hidden');
        errorMessageDiv.classList.add('hidden');
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
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

            missingSkillsList.innerHTML = '';
            if (data.missing_skills && data.missing_skills.length > 0) {
                // Display only top 5 missing skills
                data.missing_skills.slice(0, 5).forEach(skill => {
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
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            submitBtn.disabled = false;
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