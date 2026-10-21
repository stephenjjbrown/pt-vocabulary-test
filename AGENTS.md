
MVC-like Flow-like convention:
Elements should never contain Controllers or Models.
Elements should only call Controller methods.
Controllers should never contain state.
Controllers should only manipulate models.
Models should be bound to Elements (Views)
Models should only contain state and should not contain methods except readonly getters.
Elements should only read from Models and write via Controller Methods.
