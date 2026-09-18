import { SurveyProject } from '@/types/survey';
import { db, isFirebaseConfigured } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

const STORAGE_KEY_PROJECTS = 'geoverify_saved_projects_v1';

/**
 * Save a new or existing land survey project to Database (IndexedDB/Local + Firebase Firestore Cloud Sync)
 */
export async function saveSurveyProject(project: SurveyProject): Promise<boolean> {
  try {
    const existing = await getAllSurveyProjects();
    const index = existing.findIndex((p) => p.id === project.id);
    const updatedProject = {
      ...project,
      createdAt: project.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (index >= 0) {
      existing[index] = updatedProject;
    } else {
      existing.unshift(updatedProject);
    }

    // 1. Always save locally first (IndexedDB/LocalStorage) for offline field reliability
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(existing));

    // 2. Sync to Firebase Cloud Firestore if configured
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'projects', project.id);
        await setDoc(docRef, updatedProject, { merge: true });
        console.log(`Successfully synced project "${project.title}" to Firebase Firestore!`);
      } catch (fbErr) {
        console.warn('Firebase sync notice (saved locally):', fbErr);
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to save project to database:', err);
    return false;
  }
}

/**
 * Retrieve all saved survey projects from Database (Local + Firebase sync)
 */
export async function getAllSurveyProjects(): Promise<SurveyProject[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    let localProjects: SurveyProject[] = raw ? JSON.parse(raw) : [];

    // Sync from Firebase if connected
    if (isFirebaseConfigured && db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'projects'));
        const fbProjects: SurveyProject[] = [];
        querySnapshot.forEach((docSnap) => {
          fbProjects.push(docSnap.data() as SurveyProject);
        });

        if (fbProjects.length > 0) {
          // Merge local & firebase projects by ID
          const map = new Map<string, SurveyProject>();
          localProjects.forEach((p) => map.set(p.id, p));
          fbProjects.forEach((p) => map.set(p.id, p));
          localProjects = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
          localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(localProjects));
        }
      } catch (fbErr) {
        console.warn('Firebase read notice (using local storage):', fbErr);
      }
    }

    return Array.isArray(localProjects) ? localProjects : [];
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

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'projects', id));
      } catch (fbErr) {
        console.warn('Firebase delete notice:', fbErr);
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to delete project:', err);
    return false;
  }
}

/**
 * Export project as JSON file
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
