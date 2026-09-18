import { SurveyProject } from '@/types/survey';

const STORAGE_KEY_PROJECTS = 'geoverify_saved_projects_v1';
const STORAGE_KEY_SETTINGS = 'geoverify_app_settings_v1';
const STORAGE_KEY_USER = 'geoverify_user_profile_v1';

/**
 * Save a new or existing land survey project to Database (Local & Serverless ready)
 */
export async function saveSurveyProject(project: SurveyProject): Promise<boolean> {
  try {
    const existing = await getAllSurveyProjects();
    const index = existing.findIndex((p) => p.id === project.id);
    
    if (index >= 0) {
      existing[index] = { ...project, updatedAt: Date.now() };
    } else {
      existing.unshift({ ...project, createdAt: project.createdAt || Date.now(), updatedAt: Date.now() });
    }

    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(existing));
    return true;
  } catch (err) {
    console.error('Failed to save project to database:', err);
    return false;
  }
}

/**
 * Retrieve all saved survey projects from Database
 */
export async function getAllSurveyProjects(): Promise<SurveyProject[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to retrieve survey projects:', err);
    return [];
  }
}

/**
 * Delete a survey project by ID
 */
export async function deleteSurveyProject(id: string): Promise<boolean> {
  try {
    const existing = await getAllSurveyProjects();
    const filtered = existing.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete project:', err);
    return false;
  }
}

/**
 * Export project as JSON or GeoJSON file
 */
export function exportProjectFile(project: SurveyProject) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_survey.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
