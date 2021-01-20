import React from 'react'
import Link from '@material-ui/core/Link';
import { Group } from './schema';

export default function GroupCell(props: {group: Group}) {
  const domain = props.group.domain
  if (domain && domain.length > 0) {
    return <Link href={"https://" + domain} target="_blank" rel="noreferrer">{props.group.name}</Link>
  } else {
    return <div>{props.group.name}</div>
  }
}