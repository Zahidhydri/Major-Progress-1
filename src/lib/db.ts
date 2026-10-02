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

/**
 * Export project as standard GeoJSON feature collection (compatible with QGIS, ArcGIS, Google Earth)
 */
export function exportProjectGeoJSON(project: SurveyProject) {
  const coordinates = project.points.map((p) => [p.lng, p.lat, p.elevation || 0]);
  if (coordinates.length >= 3) {
    // Close the polygon ring
    coordinates.push([...coordinates[0]]);
  }

  const geoJsonData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: coordinates.length >= 3 ? 'Polygon' : 'LineString',
          coordinates: coordinates.length >= 3 ? [coordinates] : coordinates,
        },
        properties: {
          id: project.id,
          title: project.title,
          clientName: project.clientName || '',
          areaSqMeters: project.metrics?.areaSqMeters || 0,
          areaAcres: project.metrics?.areaAcres || 0,
          areaHectares: project.metrics?.areaHectares || 0,
          areaGuntha: project.metrics?.areaGuntha || 0,
          perimeterMeters: project.metrics?.perimeterMeters || 0,
          pointCount: project.points.length,
          createdAt: new Date(project.createdAt).toISOString(),
          updatedAt: new Date(project.updatedAt).toISOString(),
        },
      },
      ...project.points.map((p) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lng, p.lat, p.elevation || 0],
        },
        properties: {
          pointNumber: p.pointNumber,
          accuracyMeters: p.accuracy || 0,
          timestamp: new Date(p.timestamp).toISOString(),
          isOutlier: Boolean(p.isOutlier),
          isExcluded: Boolean(p.isExcluded),
        },
      })),
    ],
  };

  const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geoJsonData, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_survey.geojson`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Export survey boundary points as CSV spreadsheet
 */
export function exportProjectCSV(project: SurveyProject) {
  const headers = ['PointNumber', 'Latitude', 'Longitude', 'Elevation_m', 'Accuracy_m', 'Timestamp', 'IsExcluded'];
  const rows = project.points.map((p) => [
    p.pointNumber,
    p.lat.toFixed(7),
    p.lng.toFixed(7),
    p.elevation ? p.elevation.toFixed(2) : '',
    p.accuracy ? p.accuracy.toFixed(2) : '',
    new Date(p.timestamp).toISOString(),
    p.isExcluded ? 'TRUE' : 'FALSE',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_points.csv`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

