import functions_framework
from flask import jsonify, request
import base64
import json
import os
import re
from google.cloud import storage, documentai_v1 as documentai

# Initialize clients outside the function for better performance
storage_client = storage.Client()
documentai_client = documentai.DocumentProcessorServiceClient()

# Get bucket name from environment variables (set in Terraform)
KEYWORD_DATA_BUCKET = os.environ.get('KEYWORD_DATA_BUCKET')
DOCUMENT_AI_PROCESSOR_ID = os.environ.get('DOCUMENT_AI_PROCESSOR_ID')

# Load keyword data and stop words globally (or with memoization)
# In a real scenario, use functools.lru_cache or similar for efficiency
global_skills_data = {}
global_stop_words = set()

def _load_keyword_data():
    global global_skills_data, global_stop_words
    print("Loading keyword data from GCS...")
    try:
        bucket = storage_client.get_bucket(KEYWORD_DATA_BUCKET)

        # Load skills.json
        blob_skills = bucket.blob("skills.json")
        global_skills_data = json.loads(blob_skills.download_as_string())
        print(f"Loaded {len(global_skills_data)} skill categories.")

        # Load stop_words.txt
        blob_stop_words = bucket.blob("stop_words.txt")
        global_stop_words = set(blob_stop_words.download_as_string().decode('utf-8').splitlines())
        print(f"Loaded {len(global_stop_words)} stop words.")

    except Exception as e:
        print(f"Error loading keyword data: {e}")
        global_skills_data = {}
        global_stop_words = set() # Ensure it's not None

# Load data on Cloud Function warm start
_load_keyword_data()

def _extract_and_normalize_keywords(text_content):
    """Extracts and normalizes keywords from text using a predefined dictionary."""
    if not text_content:
        return {}

    # Basic text cleaning
    text_content = text_content.lower()
    text_content = re.sub(r'[^a-z0-9\s]', '', text_content) # Remove special chars

    extracted_keywords = {}

    for category, skills in global_skills_data.items():
        for skill_def in skills:
            term = skill_def['term']
            weight = skill_def.get('weight', 1.0)
            aliases = skill_def.get('aliases', [])

            # Check for the primary term
            if re.search(r'\b' + re.escape(term) + r'\b', text_content):
                extracted_keywords[term] = extracted_keywords.get(term, 0) + weight

            # Check for aliases
            for alias in aliases:
                if re.search(r'\b' + re.escape(alias) + r'\b', text_content):
                    # Add alias to the primary term's count
                    extracted_keywords[term] = extracted_keywords.get(term, 0) + weight * 0.8 # Slightly less weight for aliases

    # Optional: Add frequency for terms not in dictionary but significant (can be complex without ML)
    # For simplicity, we stick to dictionary terms here.

    return extracted_keywords

def _calculate_match_score(resume_keywords, jd_keywords):
    """Calculates a match percentage and identifies missing skills."""
    total_jd_weight = sum(jd_keywords.values())
    matched_weight = 0
    matched_skills_list = []
    missing_skills_list = []

    if total_jd_weight == 0:
        return 0, [], [] # No keywords in JD, no match

    # Identify matched skills and calculate matched weight
    for jd_skill, jd_weight in jd_keywords.items():
        if jd_skill in resume_keywords:
            # Use min weight if skill is present multiple times in both,
            # or just take the JD weight for simplicity
            matched_weight += min(jd_weight, resume_keywords[jd_skill])
            matched_skills_list.append(jd_skill)
        else:
            missing_skills_list.append(jd_skill)

    match_percentage = (matched_weight / total_jd_weight) * 100 if total_jd_weight > 0 else 0

    return round(match_percentage, 2), matched_skills_list, missing_skills_list

@functions_framework.http
def match_resume(request):
    """
    HTTP Cloud Function to match a resume with a job description.
    Expects a JSON payload with 'resume_b64' (base64 encoded resume file)
    and 'job_description_text'.
    """
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    request_json = request.get_json(silent=True)
    if not request_json:
        return jsonify({'error': 'No JSON payload provided.'}), 400, headers

    resume_b64 = request_json.get('resume_b64')
    job_description_text = request_json.get('job_description_text')
    resume_filename = request_json.get('resume_filename', 'resume.pdf')

    if not resume_b64 or not job_description_text:
        return jsonify({'error': 'Missing resume_b64 or job_description_text.'}), 400, headers

    # 1. Extract text from Resume using Document AI
    resume_text = ""
    try:
        # Document AI expects raw bytes
        resume_bytes = base64.b64decode(resume_b64)

        # Determine mime_type from filename, default to PDF
        mime_type = "application/pdf"
        if resume_filename.lower().endswith(".docx"):
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        document_proto = documentai.RawDocument(content=resume_bytes, mime_type=mime_type)
        request_doc_ai = documentai.ProcessRequest(
            name=DOCUMENT_AI_PROCESSOR_ID,
            raw_document=document_proto
        )
        response_doc_ai = documentai_client.process_document(request=request_doc_ai)
        resume_text = response_doc_ai.document.text
        print(f"Extracted {len(resume_text)} characters from resume.")

    except Exception as e:
        print(f"Error extracting text with Document AI: {e}")
        return jsonify({'error': f'Failed to process resume document: {e}'}), 500, headers

    # 2. Extract and Normalize Keywords
    resume_keywords = _extract_and_normalize_keywords(resume_text)
    jd_keywords = _extract_and_normalize_keywords(job_description_text)
    print(f"Resume keywords: {resume_keywords}")
    print(f"JD keywords: {jd_keywords}")

    # 3. Calculate Match Score and Missing Skills
    match_percentage, matched_skills, missing_skills = _calculate_match_score(resume_keywords, jd_keywords)

    # 4. Return Results
    response_data = {
        'match_percentage': match_percentage,
        'matched_skills': matched_skills,
        'missing_skills': missing_skills,
        'message': 'Match analysis complete.'
    }
    return jsonify(response_data), 200, headers