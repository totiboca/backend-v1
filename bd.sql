create database bandejas;

create table cliente (
id_cliente varchar(13) primary key,
nombre varchar(100) not null,
tipo enum("Cliente","Operador Logistico","Ambos") not null,
usuario varchar(100) unique null,
clave varchar(100) null,
fecha_creacion timestamp null default current_timestamp
);

create table fletero (
id_fletero varchar(13) primary key,
nombre varchar(100) not null
);

create table rutas(
id_ruta smallint primary key,
nombre_ruta varchar(100) not null,
ciudad varchar(100) not null,
canal varchar(100) not null,
id_cliente varchar(13) not null,
id_fletero varchar(13) null,
punto_entrega enum("CV","FLETE","SANTA TERESITA","226") not null,
entrega varchar(100) null,
supervisor varchar(100) null,
FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) on delete cascade,
foreign key (id_fletero) references fletero(id_fletero) on delete set null
);
SELECT nombre_ruta 
FROM rutas
where id_fletero="30-55149749-2";

SELECT ID_RUTA, NOMBRE_RUTA 
FROM RUTAS
WHERE CIUDAD="MAR DEL PLATA";

SELECT *
FROM RUTAS;

DELETE FROM fletero WHERE id_fletero IS NULL;

DELETE FROM movimientos;

select *
from
movimientos;
*aca PUEDO VER EL SALDO DE CADA CLIENTE UNIENDO LAS DOS TABLAS MOVIMIENTOS Y RUTAS*
select MOVIMIENTOS.id_ruta,
RUTAS.NOMBRE_RUTA,
SUM(movimientos.LLEVA) AS TOTAL_LLEVA,
SUM(MOVIMIENTOS.TRAE) AS TOTAL_TRAE,
SUM(movimientos.LLEVA) - SUM(MOVIMIENTOS.TRAE) AS SALDO
from movimientos
INNER JOIN RUTAS
ON movimientos.ID_RUTA=RUTAS.ID_RUTA
group by id_ruta
order by SALDO DESC
LIMIT 10;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(100) UNIQUE NOT NULL,
    clave VARCHAR(255) NOT NULL,
    id_cliente VARCHAR(13) UNIQUE NOT NULL,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE
);



SELECT ID_RUTA,
COUNT(*) AS CANTIDAD_REGISTROS
FROM MOVIMIENTOS
group by ID_RUTA;



SELECT movimientos.id_ruta,
rutas.nombre_ruta,
movimientos.lleva,
movimientos.trae,
movimientos.fecha_remito,
SUM(movimientos.lleva) AS TOTAL_LLEVA,
SUM(movimientos.trae) AS TOTAL_TRAE,
SUM(movimientos.lleva) - SUM(movimientos.trae) AS SALDO
FROM movimientos
INNER JOIN rutas
ON movimientos.ID_RUTA = rutas.id_ruta
group by movimientos.id_ruta,
rutas.nombre_ruta,
movimientos.lleva,
movimientos.trae,
movimientos.fecha_remito
;





SELECT * FROM fletero WHERE id_fletero IS NULL;

SET SQL_SAFE_UPDATES = 0;

create table movimientos (
id_movimiento int primary key auto_increment,
ID_RUTA smallint not null,
lleva int default 0,
trae int default 0,
fecha_remito datetime null,
n_remito int null,
fecha_carga datetime null,
FOREIGN KEY (ID_RUTA) REFERENCES RUTAS(ID_RUTA) on delete cascade
);
