interface Props {
  persian: string
  english: string | null
  persianClassName?: string
  englishClassName?: string
}

export default function BilingualText({ persian, english, persianClassName, englishClassName }: Props) {
  return (
    <div className="space-y-1">
      <p
        lang="fa"
        dir="rtl"
        className={`persian-text text-right ${persianClassName ?? 'text-xl font-medium'}`}
      >
        {persian}
      </p>
      {english && (
        <p
          lang="en"
          dir="ltr"
          className={`text-left text-gray-500 ${englishClassName ?? 'text-base'}`}
        >
          {english}
        </p>
      )}
    </div>
  )
}
