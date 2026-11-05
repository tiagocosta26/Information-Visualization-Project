import pandas as pd

df = pd.read_csv('src/Dataset_Final.csv', sep=';')

print(df.head())

df.to_json('../data/dataset.json', orient='records', force_ascii=False)

print("Conversão para JSON concluída com sucesso!")