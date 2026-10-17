
// api/src/repositories/zoneRepository.ts

import { Database } from '../config/database';
import { Character } from '../models/character';

/**
 * Manages geo-spatial data and guardian logic checks.
 */
export class ZoneRepository {
    private db: Database;

    constructor(databaseClient: Database) {
        this.db = databaseClient;
    }

    /**
     * Loads all active city zones and their boundaries.
     * @returns Promise<Array<Object>> List of active zones.
     */
    async loadActiveZones(): Promise<Array<any>> {
        // Retrieves all records from the newly created city_zones table.
        console.log("[ZoneService] Loading active city zones and boundaries...");
        const result = await this.db.query(
            `SELECT * FROM city_zones WHERE is_active = TRUE`
        );
        return result.rows;
    }

    /**
     * Checks if a given world coordinate falls within a protected zone.
     * @param x The X coordinate.
     * @param y The Y coordinate.
     * @returns Promise<string | null> The name of the city zone if inside, otherwise null.
     */
    async isCoordinateInZone(x: number, y: number): Promise<string | null> {
        // In a real implementation, this would involve complex geometric checks (e.g., Point-in-Polygon).
        // For now, we assume the boundary_coordinates JSONB structure allows point-in-polygon query.
        console.log(`[ZoneService] Checking point (${x.toFixed(2)}, ${y.toFixed(2)}) against zones.`);

        // Placeholder simplified check for the purpose of this implementation plan.
        // Actual implementation needs PostGIS or complex JSON functions.
        const result = await this.db.query(
            `SELECT city_name FROM city_zones WHERE boundary_coordinates @> $1 LIMIT 1`,
            [JSON.stringify({ x: x, y: y })]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0].city_name;
        }
        return null;
    }
}
