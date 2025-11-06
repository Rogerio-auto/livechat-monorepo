-- Migration 016: Add transcription and vision models to agents table
-- Adds support for audio transcription (Whisper) and image analysis (GPT-4 Vision)

-- Add transcription_model column (e.g., whisper-1)
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS transcription_model TEXT NULL;

-- Add vision_model column (e.g., gpt-4-vision-preview, gpt-4o)
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS vision_model TEXT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.agents.transcription_model IS 'OpenAI model for audio transcription (e.g., whisper-1)';
COMMENT ON COLUMN public.agents.vision_model IS 'OpenAI model for image analysis (e.g., gpt-4-vision-preview, gpt-4o)';
