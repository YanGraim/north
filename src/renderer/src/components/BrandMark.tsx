import mariadbSrc from '@renderer/assets/brands/mariadb.svg?url'
import mongodbSrc from '@renderer/assets/brands/mongodb.svg?url'
import mssqlSrc from '@renderer/assets/brands/mssql.svg?url'
import mysqlSrc from '@renderer/assets/brands/mysql.svg?url'
import postgresSrc from '@renderer/assets/brands/postgres.svg?url'
import redisSrc from '@renderer/assets/brands/redis.svg?url'
import sqliteSrc from '@renderer/assets/brands/sqlite.svg?url'
import { type BrandEngine, brandColorForEngine } from '@renderer/lib/engine-brands'
import { cn } from '@renderer/lib/utils'
import { resolveTheme, useUiStore } from '@renderer/stores/ui-store'

const BRAND_SRC: Record<BrandEngine, string> = {
  postgres: postgresSrc,
  mysql: mysqlSrc,
  mariadb: mariadbSrc,
  redis: redisSrc,
  mongodb: mongodbSrc,
  mssql: mssqlSrc,
  sqlite: sqliteSrc
}

type BrandMarkProps = {
  engine: BrandEngine
  className?: string
  title?: string
}

export function BrandMark({ engine, className, title }: BrandMarkProps): React.JSX.Element {
  const themePref = useUiStore((s) => s.theme)
  const color = brandColorForEngine(engine, resolveTheme(themePref))
  const src = BRAND_SRC[engine]

  return (
    <span
      {...(title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true })}
      className={cn('inline-block shrink-0', className)}
      style={{
        backgroundColor: color,
        maskImage: `url("${src}")`,
        WebkitMaskImage: `url("${src}")`,
        maskMode: 'alpha',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center'
      }}
    />
  )
}
