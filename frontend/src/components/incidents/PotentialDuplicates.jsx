import React from '../../lib/react.js';
import { Card, badge } from '../ui.js';
import { Link } from '../../app/navigation.js';
import { incId } from '../../lib/format.js';

export function PotentialDuplicates({ incident }) {
  return <div className="potential-duplicates">
    <Card title="Potential duplicates">
      <p className="help">Automatically identified reports that may describe the same problem. Review the matches before investigating; reports remain separate.</p>
      {incident.related?.length ? incident.related.map(match => <article className="note" key={match.id}>
        <Link to={'/incidents/' + match.id}>{incId(match.id) + ' · ' + match.title}</Link>
        {' '}{badge(match.status)}
        <p className="help">{match.similarity + '% similarity · ' + (match.reasons || []).join('; ')}</p>
        {match.resolution && <p>{'Previous resolution: ' + match.resolution}</p>}
      </article>) : <p className="help">No potential duplicates found among your accessible incidents.</p>}
    </Card>
  </div>;
}
