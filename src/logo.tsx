import React from 'react'
import Link from '@material-ui/core/Link'
import Box from '@material-ui/core/Box'
const logo = require('../static/logo.svg')

export default function Logo() {
  return (
    <Box py={2}>
      <Link href="/"><img src={logo} alt="Logo" width={300} /></Link>
    </Box>
  )
}