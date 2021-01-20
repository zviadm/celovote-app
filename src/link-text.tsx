import React from 'react'
import Link from '@material-ui/core/Link'

const LinkText = (props: {href: string, text: string | JSX.Element}) => (
  <Link href={props.href} target="_blank" rel="noreferrer">{props.text}</Link>
)
export default LinkText