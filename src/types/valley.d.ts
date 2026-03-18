declare module 'valley' {
  type FieldValidator = (
    value: unknown,
    key: string,
    object: Record<string, unknown>,
  ) => boolean | Error

  type FieldConfig = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor | FieldValidator

  interface ValidatorConfig {
    [key: string]: FieldConfig
  }

  function valley(config: ValidatorConfig): (data: unknown) => Error | null

  export = valley
}
